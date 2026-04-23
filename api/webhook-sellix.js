// ============================================================
//  api/webhook-sellix.js — Obsługa płatności z Sellix.io
//  Zmienne env: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const crypto = require('crypto');

// Pomocnicza funkcja do zapytań do Supabase (taka sama jak w auth.js)
function supa(url, token, method, path, body) {
    return fetch(url + "/rest/v1/" + path, {
        method: method,
        headers: {
            "apikey": token,
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        body: body ? JSON.stringify(body) : undefined
    }).then(r => r.json());
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const payload = req.body;
        
        // Sellix wysyła zdarzenie 'order:paid' po udanej zapłacie
        if (payload.event === 'order:paid') {
            const order = payload.data;
            
            // 1. Pobieranie danych z zamówienia
            const productId = order.product_id;
            
            // Sellix przechowuje pola niestandardowe w custom_fields
            const connectCode = order.custom_fields?.connect_code || order.custom_fields?.["Connect Code"];
            const customerEmail = order.customer_email;

            let creditsToAdd = 0;

            // 2. Ustalanie ilości tokenów po ID produktu (Podmień na swoje z Sellix!)
            if (productId === 'SELLIX_PRODUCT_ID_STARTER') creditsToAdd = 40;
            else if (productId === 'SELLIX_PRODUCT_ID_PRO') creditsToAdd = 160;
            else if (productId === 'SELLIX_PRODUCT_ID_ULTRA') creditsToAdd = 350;
            else {
                // Fallback po cenie jeśli produkt ID nie jest wpisany (np. total w oryginalnej walucie np. 15.00 PLN)
                if (order.total === 15) creditsToAdd = 40;
                else if (order.total === 30) creditsToAdd = 160;
                else if (order.total === 100) creditsToAdd = 350;
                else creditsToAdd = 0; // Nieznana kwota
            }

            console.log(`[SELLIX] Nowe zamówienie opłacone! Kredyty do dodania: ${creditsToAdd}. Connect Code: ${connectCode}, Email: ${customerEmail}`);

            if (creditsToAdd > 0) {
                const supabaseUrl = process.env.SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

                // 3. Szukamy użytkownika po kodzie łączenia LUB emailu
                let userRecord = null;
                
                if (connectCode) {
                    const resCode = await supa(supabaseUrl, supabaseKey, 'GET', `users?connect_code=eq.${connectCode}&select=*`);
                    if (resCode && resCode.length > 0) userRecord = resCode[0];
                }

                if (!userRecord && customerEmail) {
                    const resEmail = await supa(supabaseUrl, supabaseKey, 'GET', `users?email=eq.${customerEmail}&select=*`);
                    if (resEmail && resEmail.length > 0) userRecord = resEmail[0];
                }

                // 4. Aktualizacja bazy
                if (userRecord) {
                    const currentCredits = parseInt(userRecord.credits) || 0;
                    const newCredits = currentCredits + creditsToAdd;

                    await supa(supabaseUrl, supabaseKey, 'PATCH', `users?id=eq.${userRecord.id}`, {
                        credits: newCredits
                    });

                    console.log(`[SELLIX] Sukces! Dodano ${creditsToAdd} kredytów dla ${userRecord.username}. Stan konta: ${newCredits}`);
                } else {
                    console.log(`[SELLIX] BŁĄD: Nie znaleziono usera dla kodu ${connectCode} ani maila ${customerEmail}.`);
                }
            } else {
                console.log(`[SELLIX] UWAGA: Zamówienie nie kwalifikuje się do przyznania kredytów (zła kwota / nieznany produkt).`);
            }
        } else {
            console.log(`[SELLIX] Zignorowano zdarzenie: ${payload.event}`);
        }

        // Musimy zwrócić status 200 do Sellix
        res.status(200).json({ success: true, message: 'Webhook received' });

    } catch (err) {
        console.error('[SELLIX] Webhook error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

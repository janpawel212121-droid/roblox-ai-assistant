// ============================================================
//  api/webhook-polar.js — Obsługa płatności z Polar.sh
//  Zmienne env: SUPABASE_URL, SUPABASE_SERVICE_KEY, POLAR_WEBHOOK_SECRET
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
    // 1. Zezwolenie tylko na metodę POST (webhook z Polar wysyła POST)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const payload = req.body;
        
        // (Opcjonalnie) Tutaj powinieneś zweryfikować podpis Webhooka (Polar Signature),
        // aby upewnić się, że zapytanie pochodzi prawdziwie z Polar.sh.
        // Jeśli masz POLAR_WEBHOOK_SECRET, robisz to tutaj.

        // 2. Obsługa tylko zdarzenia udanego opłacenia zamówienia
        if (payload.type === 'order.created') {
            const order = payload.data;
            
            // 3. Pobieranie danych z zamówienia
            // Polar domyślnie posiada ID produktu i cokolwiek przekazaliśmy w metadanych checkoutu
            const productId = order.product_id;
            
            // Musisz wiedzieć jaki użytkownik kupił. 
            // W Polar można dodawać Custom Fields do produktu, w którym użytkownik podaje np. "Astro Connect Code" (np. twój kod: rc_...) 
            // albo użyć metadata z linku checkoutu.
            const connectCode = order.custom_field_data?.connect_code || order.metadata?.connect_code;
            const customerEmail = order.customer_email;

            let creditsToAdd = 0;

            // Ustalanie ilości tokenów po ID produktu (Podmień te ID na swoje z Polar.sh!)
            if (productId === 'PRODUCT_ID_STARTER') creditsToAdd = 40;
            else if (productId === 'PRODUCT_ID_PRO') creditsToAdd = 160;
            else if (productId === 'PRODUCT_ID_ULTRA') creditsToAdd = 350;
            else {
                // Alternatywnie po cenie, jeśli produkt nieznany (w centach)
                if (order.amount === 1500) creditsToAdd = 40; // 15 PLN
                if (order.amount === 3000) creditsToAdd = 160; // 30 PLN
                if (order.amount === 10000) creditsToAdd = 350; // 100 PLN
            }

            console.log(`[POLAR] Nowe zamówienie! Otrzymano wpłatę za ${creditsToAdd} kredytów. Kod łączenia: ${connectCode}, Email: ${customerEmail}`);

            if (creditsToAdd > 0) {
                const supabaseUrl = process.env.SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Używamy Service Key do operacji w tle

                // 4. Szukamy użytkownika po kodzie łączenia (Connect Code) LUB po emailu
                let userRecord = null;
                
                if (connectCode) {
                    const resCode = await supa(supabaseUrl, supabaseKey, 'GET', `users?connect_code=eq.${connectCode}&select=*`);
                    if (resCode && resCode.length > 0) userRecord = resCode[0];
                }

                if (!userRecord && customerEmail) {
                    const resEmail = await supa(supabaseUrl, supabaseKey, 'GET', `users?email=eq.${customerEmail}&select=*`);
                    if (resEmail && resEmail.length > 0) userRecord = resEmail[0];
                }

                // 5. Aktualizacja kredytów
                if (userRecord) {
                    const currentCredits = parseInt(userRecord.credits) || 0;
                    const newCredits = currentCredits + creditsToAdd;

                    await supa(supabaseUrl, supabaseKey, 'PATCH', `users?id=eq.${userRecord.id}`, {
                        credits: newCredits
                    });

                    console.log(`[POLAR] Sukces! Użytkownik ${userRecord.username} otrzymał ${creditsToAdd} kredytów. Nowy stan: ${newCredits}`);
                } else {
                    console.log(`[POLAR] UWAGA: Nie znaleziono użytkownika dla kodu ${connectCode} / emailu ${customerEmail}. Kredyty nie zostały przypisane!`);
                }
            }
        }

        // Musimy zwrócić 200 OK do serwerów Polar, żeby wiedzieli że odebraliśmy powiadomienie
        res.status(200).json({ success: true, message: 'Webhook received' });

    } catch (err) {
        console.error('[POLAR] Webhook error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

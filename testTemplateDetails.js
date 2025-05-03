/**
 * Test avanzato per verificare l'estrazione di articoli e prezzi dai diversi template
 */

// Importa il contentCleaner modificato
// Nota: assicurati di adeguare il percorso se necessario
const contentCleaner = require('./src/services/contentCleaner');

// Template di esempio basati sulle immagini fornite
const templates = [
  {
    name: "Template 1 - BEST SPREADSHEET",
    text: `💯 BEST SPREADSHEET 💯
🔍Article: Palm Angels T-Shirt
💰Price: 15.39$
🔗 AllchinaBuy Link
🔗 CnFans Link
🔗 Hoobuy Link
🔗 LoongBuy Link
🔗 MuleBuy Link
👍 1 ❤️ 1`
  },
  {
    name: "Template 2 - HOOBUY-ALLCHINABUY",
    text: `**👍***Official Spreadsheet**❤️
🔍Article:NIKE Couple bag
💰Price: $ 27
**✅weidian Link**
**🔗Cnfans Link**
**🔗allchinabuy Link**
**🔗Hoobuy Link**
**🔗loongbuy Link**
**🔗Mulebuy Link**
**🔗oopbuy Link**
**📱 seller whatsapp 📱 **
**📱 telegram 📱 **`
  },
  {
    name: "Template 3 - Official spreadsheet",
    text: `** 🏆 Official spreadsheet 🏆 **
🔍Article : Hellstar Hoodie
💰Price : 26€
** **✅**weidian Link **
✅**Mulebuy Link**
✅**__Cnfans Link__**
📱 **oopbuy Link**
🔗**Hoobuy Link**
🔗**kakobuy Link**
🔗**allchinabuy Link**
🔗**loongbuy Link**
📱 **Customer Service** 📱
📱 **telegram_Service ** 📱`
  },
  {
    name: "Template 4 - Trusted Seller List",
    text: `🏆 Trusted Seller List 🏆
🔍Article :Max Dn Shoes
💰Price :CNY ¥ 179.00 ≈ $ 27.12
🏬Weidian Link
🅾️Go to Mulebuy
©️Go to CNFans
🅾️Go to OOPBuy

" ©️CNFans" and "🅾️Mulebuy" discount code: "
"FashionRepsTG" (15% shipping discount)

📱Seller WhatsApp📱
🌎Official Discussion Group🌎`
  },
  {
    name: "Template 5 - China2u Links",
    text: `📱 China2u Links (Mobile)
💻 China2u Links (PC)
🔍 Article: Ralph Lauren socks
💰 Price: $8.81
🏆 2025 Product/Catalog Website -Must See
🚂 Luxury Reps Premium Album -10,000 Bags&Shoes

🔗 Discord: Join for 20% OFF coupon!
🏆 WhatsApp: Free W2C VIP—Your Exclusive Butler!

Open 2025 Product/Catalog ,Use our AI Finding Tool, Upload picture 
or type name of product, you will get purchasing link right away! 👇
🚂 Coupon`
  }
];

// Simula la funzione prepareCaption del mediaProcessor
function prepareCaption(processedContent) {
    let caption = processedContent.text || '';
    
    // Se il testo è vuoto dopo la pulizia, usa un messaggio generico
    if (!caption || caption.trim() === '') {
      caption = 'Nuovo prodotto disponibile';
    }
    
    // Formatta il caption finale
    let finalCaption = '';
    
    // Aggiungi il titolo in grassetto con "Article:" davanti
    finalCaption = `<b>🔎 Article: ${caption}</b>`;
    
    // Aggiungi informazioni sul prezzo se presente
    if (processedContent.price) {
      // Aggiungi il prezzo formattato senza indicazione del markup
      finalCaption += `\n\n💰 Price: ${processedContent.price.final} ${processedContent.price.currency}`;
    }
    
    return finalCaption;
  }

// Funzione di test avanzata
function testTemplatesDetailed() {
  console.log('=== TEST DETTAGLIATO ESTRAZIONE ARTICOLI E PREZZI ===\n');
  
  for (const template of templates) {
    console.log(`\n${'-'.repeat(60)}`);
    console.log(`Template: ${template.name}`);
    console.log(`${'-'.repeat(60)}`);
    
    console.log('Testo originale (prime 3 righe):');
    const textLines = template.text.split('\n').slice(0, 3);
    textLines.forEach(line => console.log(`> ${line}`));
    console.log('...\n');
    
    // Test estrazione articolo
    const articleName = contentCleaner.extractArticleName(template.text);
    console.log(`🔍 Articolo estratto: "${articleName}"`);
    
    // Test estrazione prezzo
    const extractedPrice = contentCleaner.extractPrice(template.text);
    console.log('💰 Prezzo originale estratto:', extractedPrice ? 
      `${extractedPrice.original} ${extractedPrice.currency}` : 'Non trovato');
    
    // Test applicazione markup 25%
    if (extractedPrice) {
      const priceWithMarkup = contentCleaner.applyMarkup(extractedPrice, 25);
      console.log(`💹 Prezzo con markup 25%: ${priceWithMarkup.final} ${priceWithMarkup.currency}`);
      console.log(`📊 Differenza: +${(priceWithMarkup.final - extractedPrice.original).toFixed(2)} ${extractedPrice.currency} (+${((priceWithMarkup.final / extractedPrice.original - 1) * 100).toFixed(0)}%)`);
    }
    
    // Simula l'output finale
    const processedContent = {
      text: articleName,
      price: extractedPrice ? contentCleaner.applyMarkup(extractedPrice, 25) : null
    };
    
    console.log('\n✅ RISULTATO FINALE');
    console.log('-----------------');
    console.log(prepareCaption(processedContent));
    console.log('-----------------');
  }
  
  console.log('\n=== TEST COMPLETATO ===');
}

// Esegui il test
testTemplatesDetailed();
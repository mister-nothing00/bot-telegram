class ContentCleaner {
  removeLinks(text) {
    if (!text) return '';
    
    // Rimuove URL
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    
    // Rimuove menzioni Telegram @username
    text = text.replace(/@\w+/g, '');
    
    // Rimuove link Telegram t.me
    text = text.replace(/t\.me\/[^\s]+/g, '');
    
    // Rimuove pattern di link specifici
    text = text.replace(/🔗\s*.*?Link\s*/gi, '');
    text = text.replace(/📋\s*.*?Link\s*/gi, '');
    text = text.replace(/Allchinabuy Link|CnFans Link|MuleBuy Link|Hoobuy Link|Loongbuy Link|BEST SPREADSHEET/gi, '');
    
    // Rimuove emoji dei link
    text = text.replace(/🔗|📋|💯/g, '');
    
    // Pulisce spazi multipli
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  extractPrice(text, priceRegex) {
    if (!text) return null;
    
    // Cerca diversi formati di prezzo
    const patterns = [
      /\$\s*(\d+([.,]\d{1,2})?)/i,  // $18.33
      /€\s*(\d+([.,]\d{1,2})?)/i,   // €18.33
      /Price:\s*(\d+([.,]\d{1,2})?)\s*\$/i,  // Price: 18.33$
      /Price:\s*\$\s*(\d+([.,]\d{1,2})?)/i,  // Price: $18.33
      /(\d+([.,]\d{1,2})?)\s*\$/i,   // 18.33$
      /(\d+([.,]\d{1,2})?)\s*€/i     // 18.33€
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const priceValue = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(priceValue)) {
          return {
            original: priceValue,
            currency: match[0].includes('€') ? '€' : '$'
          };
        }
      }
    }
    
    return null;
  }

  applyMarkup(price, markupPercentage = 17) {
    if (!price) return null;
    
    const markup = price.original * (markupPercentage / 100);
    const finalPrice = price.original + markup;
    
    return {
      original: price.original,
      markup: markup,
      final: parseFloat(finalPrice.toFixed(2)),
      currency: price.currency
    };
  }
}

module.exports = new ContentCleaner();
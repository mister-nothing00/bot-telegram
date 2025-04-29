/**
 * ContentCleaner - Servizio per pulire e formattare il contenuto dei messaggi
 *
 * Responsabilità:
 * 1. Rimuovere tutti i tipi di link esterni
 * 2. Estrarre prezzi in diversi formati
 * 3. Applicare markup ai prezzi
 * 4. Formattare il testo in modo coerente
 */
class ContentCleaner {
  /**
   * Rimuove tutti i tipi di link e riferimenti esterni dal testo
   * @param {String} text - Testo originale
   * @returns {String} Testo pulito
   */
  removeLinks(text) {
    if (!text) return '';
    
    // Prima salvare il contenuto che vogliamo mantenere
    let articleMatch = text.match(/Article:\s*([^$\n]+)/i);
    let articleName = articleMatch ? articleMatch[1].trim() : null;
    
    let priceMatch = text.match(/Price\s*:\s*\$?\s*(\d+([.,]\d{1,2})?)/i);
    let price = priceMatch ? priceMatch[1] : null;
    
    // Rimuovere sezioni intere con link
    let lines = text.split('\n');
    let cleanedLines = [];
    
    for (let line of lines) {
      // Salta linee che contengono parole chiave associate a link
      if (
        !/link|weidian|cnfans|allchinabuy|hoobuy|mulebuy|loongbuy|oopbuy|kakobuy|customer service|telegram|discord|whatsapp|spreadsheet|🔗|📋|📎|💯|✅/i.test(line) &&
        !/\*\*.*\*\*/i.test(line) // Rimuovi linee con testo tra asterischi doppi
      ) {
        cleanedLines.push(line);
      }
    }
    
    // Ricrea il testo base
    text = cleanedLines.join('\n');
    
    // Array di pattern da rimuovere
    const patterns = [
      // URL e link
      /https?:\/\/[^\s]+/g,
      /t\.me\/[^\s]+/g,
      
      // Menzioni e tag
      /@\w+/g,
      /#\w+/g,
      
      // Pattern specifici osservati negli screenshot
      /\*\*.*?Link.*?\*\*/gi,
      /\*\*.*?Service.*?\*\*/gi,
      /\*\*.*?spreadsheet.*?\*\*/gi,
      /\*\*.*?official.*?\*\*/gi,
      
      // Emoji e simboli associati a link
      /🔗|📋|💯|📎|🧷|➡️|🌐|🔍/g,
      
      // Rimuovere tutto ciò che è tra ** **
      /\*\*.*?\*\*/g,
      
      // Parole chiave specifiche
      /\b(weidian|cnfans|allchinabuy|hoobuy|mulebuy|loongbuy|oopbuy|kakobuy)\b/gi,
      /\b(customer service|telegram|discord|whatsapp)\b/gi,
      /\b(spreadsheet|coupon|now)\b/gi,
      
      // Simboli e formattazione speciale
      /✅|❤️|💕|🔥|💪|👌/g
    ];
    
    // Applica tutti i pattern di pulizia
    patterns.forEach(pattern => {
      text = text.replace(pattern, '');
    });
    
    // Pulisci le linee vuote multiple e spazi
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/\s+/g, ' ');
    text = text.trim();
    
    // Se abbiamo un articolo e/o un prezzo, ricostruiamo il testo principale
    let result = '';
    
    if (articleName) {
      result = articleName;
    }
    
    return result;
  }

  /**
   * Estrae informazioni sul prezzo dal testo
   * @param {String} text - Testo da cui estrarre il prezzo
   * @param {String} customRegex - Regex personalizzata (opzionale)
   * @returns {Object|null} Oggetto con dettagli sul prezzo o null
   */
  extractPrice(text, customRegex = null) {
    if (!text) return null;
    
    // Patterns per diversi formati di prezzo
    const patterns = [
      // $ prima del numero
      /\$\s*(\d+([.,]\d{1,2})?)/i,  // $18.33
      
      // € prima del numero
      /€\s*(\d+([.,]\d{1,2})?)/i,   // €18.33
      
      // Formato "Price: X$"
      /Price:?\s*(\d+([.,]\d{1,2})?)\s*\$/i,  // Price: 18.33$
      /Price:?\s*\$\s*(\d+([.,]\d{1,2})?)/i,  // Price: $18.33
      
      // Formato "Price: X€"
      /Price:?\s*(\d+([.,]\d{1,2})?)\s*€/i,  // Price: 18.33€
      /Price:?\s*€\s*(\d+([.,]\d{1,2})?)/i,  // Price: €18.33
      
      // Simbolo dopo il numero
      /(\d+([.,]\d{1,2})?)\s*\$/i,   // 18.33$
      /(\d+([.,]\d{1,2})?)\s*€/i,     // 18.33€
      
      // Formato "X$" o "X€" generico
      /(\d+([.,]\d{1,2})?)\s*(\$|€)/i, // 18.33$ o 18.33€
    ];
    
    // Aggiungi eventuale regex personalizzata
    if (customRegex) {
      try {
        const regex = new RegExp(customRegex, 'i');
        patterns.unshift(regex);
      } catch (e) {
        console.error(`Regex personalizzata non valida: ${customRegex}`);
      }
    }
    
    // Cerca il prezzo in base ai pattern
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Converti in numero float
        const price = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(price)) {
          return {
            original: price,
            currency: match[0].includes('€') ? '€' : '$'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Applica markup al prezzo
   * @param {Object} price - Informazioni sul prezzo
   * @param {Number} markupPercentage - Percentuale di markup
   * @returns {Object} Prezzo con markup applicato
   */
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

  /**
   * Formatta il testo in modo standardizzato
   * @param {String} text - Testo da formattare
   * @returns {String} Testo formattato
   */
  formatText(text) {
    if (!text) return '';
    
    // 1. Rimuovi link
    text = this.removeLinks(text);
    
    // 2. Normalizza gli spazi
    text = text.replace(/\s+/g, ' ').trim();
    
    // 3. Formatta i punti elenco
    text = text.replace(/^[-*•]\s*/gm, '• ');
    
    // 4. Assicurati che ci siano spazi dopo la punteggiatura
    text = text.replace(/([.,!?])([^\s])/g, '$1 $2');
    
    // 5. Capitalizza la prima lettera di ogni frase
    text = text.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    
    return text;
  }
}

module.exports = new ContentCleaner();
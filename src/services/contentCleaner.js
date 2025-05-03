/**
 * ContentCleaner - Servizio per pulire e formattare il contenuto dei messaggi
 *
 * Responsabilità:
 * 1. Estrarre il nome dell'articolo dai vari template
 * 2. Estrarre prezzi in diversi formati
 * 3. Applicare markup ai prezzi (25%)
 * 4. Rimuovere tutti i link e contenuti non necessari
 */
class ContentCleaner {
  /**
   * Estrae il nome dell'articolo dal testo in base a vari pattern
   * @param {String} text - Testo originale
   * @returns {String|null} Nome dell'articolo o null se non trovato
   */
  extractArticleName(text) {
    if (!text) return null;
    
    // Array di pattern per l'estrazione dell'articolo
    const patterns = [
      // Formato "Article: X" o "Article : X" o "Article :X"
      /Article\s*:+\s*([^$\n]+)/i,
      
      // Formato "Article:X" o "Article :X"
      /Article:+\s*([^$\n]+)/i,
      
      // Altre varianti come "Article :" 
      /Article\s+:\s*([^$\n]+)/i,
      
      // "ℹ️Article:" o altri emoji + Article
      /[^\w]*Article:+\s*([^$\n]+)/i,
      
      // 🔍Article:
      /🔍\s*Article:+\s*([^$\n]+)/i,
      
      // Nome articolo preceduto da emoji senza la parola "Article"
      /🔍\s*:\s*([^$\n]+)/i,
      
      // Cerca anche senza spazi dopo i due punti
      /Article:([^$\n]+)/i
    ];
    
    // Cerca l'articolo in base ai pattern
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Se non troviamo l'articolo con i pattern specifici, cerchiamo la prima riga utile
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim() && 
          !line.match(/link|price|prezzo|seller|weidian|cnfans|spreadsheet|trusted|official|discord|instagram|telegram/i) &&
          !line.match(/[🔗📱💰💯🔍📊📈📋📌📎🏆✅]/)) {
        return line.trim();
      }
    }
    
    return null;
  }

  /**
   * Rimuove tutti i tipi di link e riferimenti esterni dal testo
   * Ora estrae solo l'articolo e tralascia tutto il resto
   * @param {String} text - Testo originale
   * @returns {String} Solo il nome dell'articolo
   */
  removeLinks(text) {
    if (!text) return '';
    
    // Estrai solo il nome dell'articolo
    const articleName = this.extractArticleName(text);
    
    // Restituisci solo il nome dell'articolo
    return articleName || '';
  }

  /**
   * Estrae informazioni sul prezzo dal testo
   * @param {String} text - Testo da cui estrarre il prezzo
   * @param {String} customRegex - Regex personalizzata (opzionale)
   * @returns {Object|null} Oggetto con dettagli sul prezzo o null
   */
  extractPrice(text, customRegex = null) {
    if (!text) return null;
    
    // Pattern specifico per CNY conversioni (es: "Price :CNY ¥ 179.00 ≈ $ 27.12")
    const cnyPattern = /Price\s*:CNY\s*¥\s*(\d+([.,]\d{1,2})?)\s*(?:≈|=)\s*\$\s*(\d+([.,]\d{1,2})?)/i;
    const cnyMatch = text.match(cnyPattern);
    if (cnyMatch && cnyMatch[3]) {
      // Usa il valore convertito in dollari se disponibile
      const price = parseFloat(cnyMatch[3].replace(',', '.'));
      if (!isNaN(price)) {
        return {
          original: price,
          currency: '$'
        };
      }
    }
    
    // Patterns per diversi formati di prezzo
    const patterns = [
      // Formato "Price: X$" o "Price: X €" o "Price: $ X"
      /Price\s*:?\s*\$?\s*(\d+([.,]\d{1,2})?)/i,  // Price: 18.33
      /Price\s*:?\s*(\d+([.,]\d{1,2})?)\s*\$/i,   // Price: 18.33$
      /Price\s*:?\s*\$\s*(\d+([.,]\d{1,2})?)/i,   // Price: $18.33
      /Price\s*:?\s*€?\s*(\d+([.,]\d{1,2})?)/i,   // Price: 18.33
      /Price\s*:?\s*(\d+([.,]\d{1,2})?)\s*€/i,    // Price: 18.33€
      /Price\s*:?\s*€\s*(\d+([.,]\d{1,2})?)/i,    // Price: €18.33
      
      // Formato con simbolo di valuta e prezzo
      /\$\s*(\d+([.,]\d{1,2})?)/i,   // $18.33
      /(\d+([.,]\d{1,2})?)\s*\$/i,   // 18.33$
      /€\s*(\d+([.,]\d{1,2})?)/i,    // €18.33
      /(\d+([.,]\d{1,2})?)\s*€/i,    // 18.33€
      
      // Formati con emoji 💰 
      /💰\s*Price\s*:?\s*(\d+([.,]\d{1,2})?)/i,  // 💰Price: 18.33
      /💰\s*Price\s*:?\s*\$\s*(\d+([.,]\d{1,2})?)/i,  // 💰Price: $18.33
      /💰\s*Price\s*:?\s*(\d+([.,]\d{1,2})?)\s*\$/i,  // 💰Price: 18.33$
      
      // Cerca dopo un simbolo di valuta tra 0 e 20 caratteri quindi un numero (per formati strani)
      /\$[^0-9]{0,20}(\d+([.,]\d{1,2})?)/i,  // $ ... 18.33
      /€[^0-9]{0,20}(\d+([.,]\d{1,2})?)/i,   // € ... 18.33
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
      if (match && match[1]) {
        // Converti in numero float
        const priceStr = match[1].replace(',', '.');
        const price = parseFloat(priceStr);
        if (!isNaN(price)) {
          // Determina la valuta
          let currency = '$';  // Imposta $ come default
          if (match[0].includes('€')) {
            currency = '€';
          }
          
          return {
            original: price,
            currency: currency
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Applica markup al prezzo
   * @param {Object} price - Informazioni sul prezzo
   * @param {Number} markupPercentage - Percentuale di markup (25%)
   * @returns {Object} Prezzo con markup applicato
   */
  applyMarkup(price, markupPercentage = 25) {  // Default a 25%
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
   * Formatta il testo eliminando caratteri superflui
   * @param {String} text - Testo da formattare
   * @returns {String} Testo formattato
   */
  formatText(text) {
    if (!text) return '';
    
    // Normalizza gli spazi e rimuovi caratteri speciali
    text = text.replace(/\s+/g, ' ').trim();
    
    // Rimuovi emoji e altri caratteri speciali
    text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    
    // Rimuovi punteggiatura extra
    text = text.replace(/[^\w\s.,!?'"-]/g, '');
    
    // Rimuovi spazi multipli
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }
}

module.exports = new ContentCleaner();
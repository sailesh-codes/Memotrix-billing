/**
 * Convert number to Indian Currency Words (e.g. 1080.00 -> "One Thousand and Eighty Rupees only")
 */
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertLessThanThousand(num) {
  if (num === 0) return '';
  let str = '';
  if (num >= 100) {
    str += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num > 0) {
    if (str !== '') str += 'and ';
    if (num < 20) {
      str += ones[num] + ' ';
    } else {
      str += tens[Math.floor(num / 10)] + ' ';
      if (num % 10 > 0) {
        str += ones[num % 10] + ' ';
      }
    }
  }
  return str;
}

export function numberToWords(amount) {
  if (isNaN(amount) || amount === 0) return 'Zero Rupees only';
  
  const numStr = parseFloat(amount).toFixed(2);
  const parts = numStr.split('.');
  let rupees = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  let result = '';

  const crore = Math.floor(rupees / 10000000);
  rupees %= 10000000;

  const lakh = Math.floor(rupees / 100000);
  rupees %= 100000;

  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;

  if (crore > 0) {
    result += convertLessThanThousand(crore) + 'Crore ';
  }
  if (lakh > 0) {
    result += convertLessThanThousand(lakh) + 'Lakh ';
  }
  if (thousand > 0) {
    result += convertLessThanThousand(thousand) + 'Thousand ';
  }
  if (rupees > 0) {
    result += convertLessThanThousand(rupees);
  }

  result = result.trim();
  if (result.length === 0) {
    result = 'Zero';
  }

  let output = result + ' Rupees';

  if (paise > 0) {
    output += ' and ' + convertLessThanThousand(paise).trim() + ' Paise';
  }

  output += ' only';
  return output;
}

export default numberToWords;

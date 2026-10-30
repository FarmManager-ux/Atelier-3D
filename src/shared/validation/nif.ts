/**
 * Valida o formato e o dígito de controlo de um NIF português
 * (9 dígitos; primeiro dígito 1,2,3,5,6,8,9 ou prefixos 45, 70-79, 90, 91, 98, 99).
 */
export function isValidPortugueseNif(value: string): boolean {
  const nif = value.replace(/\s/g, "");
  if (!/^\d{9}$/.test(nif)) return false;
  if (!/^(1|2|3|5|6|8|9|45|70|71|72|74|75|77|78|79|90|91|98|99)/.test(nif)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i);
  const check = 11 - (sum % 11);
  const digit = check >= 10 ? 0 : check;
  return digit === Number(nif[8]);
}

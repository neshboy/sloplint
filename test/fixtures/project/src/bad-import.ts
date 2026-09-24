// Imports a package that does not exist and is not declared in this
// fixture's package.json - the classic "agent invented a package name" bug.
import { formatCurrency } from 'money-formatter-plus-ai';

export function displayPrice(amount: number): string {
  return formatCurrency(amount, 'USD');
}

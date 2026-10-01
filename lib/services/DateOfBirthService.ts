export type RegistrationAccountType = 'student' | 'regular' | '';

export type DateOfBirthValidationResult =
  | { valid: true; age: number; date: Date }
  | { valid: false; age: null; date: null; message: string };

export class DateOfBirthService {
  private static instance: DateOfBirthService;
  private readonly maximumAge = 120;

  private constructor() {}

  public static getInstance(): DateOfBirthService {
    if (!DateOfBirthService.instance) DateOfBirthService.instance = new DateOfBirthService();
    return DateOfBirthService.instance;
  }

  public formatIso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  public parse(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  public validate(value: string, accountType: RegistrationAccountType, today = new Date()): DateOfBirthValidationResult {
    const date = this.parse(value);
    if (!date) return { valid: false, age: null, date: null, message: 'Please select a valid date of birth.' };
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date > todayDate) return { valid: false, age: null, date: null, message: 'Date of birth cannot be in the future.' };
    let age = todayDate.getFullYear() - date.getFullYear();
    if (todayDate.getMonth() < date.getMonth() || (todayDate.getMonth() === date.getMonth() && todayDate.getDate() < date.getDate())) age -= 1;
    if (age > this.maximumAge) return { valid: false, age: null, date: null, message: 'Please select a date of birth within the last 120 years.' };
    if (age < 13) return { valid: false, age: null, date: null, message: 'You must be at least 13 years old to use Ourlime.' };
    if (accountType === 'regular' && age < 16) return { valid: false, age: null, date: null, message: 'Regular accounts require users to be at least 16 years old. Please register as a Student instead.' };
    return { valid: true, age, date };
  }
}

export const dateOfBirthService = DateOfBirthService.getInstance();

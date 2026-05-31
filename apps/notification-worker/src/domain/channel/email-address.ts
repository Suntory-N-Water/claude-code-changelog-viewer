declare const emailAddressBrand: unique symbol;

export type EmailAddress = string & {
  readonly [emailAddressBrand]: unknown;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createEmailAddress(value: string): EmailAddress {
  if (!EMAIL_REGEX.test(value)) {
    throw new Error('メールアドレスの形式が不正です');
  }

  return value as EmailAddress;
}

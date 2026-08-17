declare const emailAddressBrand: unique symbol;

export type EmailAddress = string & {
  [emailAddressBrand]: unknown;
};

/**
 * @see https://zenn.dev/igz0/articles/email-validation-regex-best-practices
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidEmailAddress(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function createEmailAddress(value: string): EmailAddress {
  if (!isValidEmailAddress(value)) {
    throw new Error('メールアドレスの形式が不正です');
  }

  return value as EmailAddress;
}

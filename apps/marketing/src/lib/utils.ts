import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const APP_URL = 'https://contracts.cresco.org'
export const SITE_URL = 'https://contracts.cresco.org'
export const GITHUB_URL = 'https://github.com/CRESCO-Software-Technology/Legal-draft'

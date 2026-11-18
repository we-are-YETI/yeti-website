import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function processImageUrl(
  url: string | null | undefined,
  fallback: string = "/logo.jpg"
): string {
  if (!url || typeof url !== 'string') {
    return fallback
  }

  // 1. Handle Google Drive Links
  // Matches: /d/ID, id=ID, file/d/ID, open?id=ID
  const driveMatch = url.match(/(?:\/d\/|id=|file\/d\/|open\?id=)([-\w]{25,})/)
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1]
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
  }

  // 2. Pass through other valid URLs (e.g. ImageKit, Unsplash, etc.)
  if (url.startsWith('http')) {
    return url
  }

  console.warn(`Could not parse link, returning fallback: ${url}`)
  return fallback
}

// Backward compatibility alias if needed, but we will update usages.
export const convertGoogleDriveLink = processImageUrl

export const CITY_HOSTNAMES: Record<string, string> = {
  "yeti-dresden.org": "Dresden",
  "www.yeti-dresden.org": "Dresden",
  "yeti-leipzig.org": "Leipzig",
  "www.yeti-leipzig.org": "Leipzig",
  //For local testing of the fuctionality, you can add your local hostnames here. For example:
  // "localhost": "LocalTest",
  // "127.0.0.1": "LocalTest2",
}

export function getCityFromHostname(hostname?: string): string {
  const host =
    hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  return CITY_HOSTNAMES[host.toLowerCase()] ?? "Dresden"
}

export const isLeipzig = (): boolean => getCityFromHostname() === "Leipzig"


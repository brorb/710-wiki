import { config } from "./config.js"

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

type RecaptchaResponse = {
  success: boolean
  score?: number
  action?: string
  challenge_ts?: string
  hostname?: string
  "error-codes"?: string[]
}

export const isRecaptchaEnabled = (): boolean => Boolean(config.recaptchaSecret)

export const verifyRecaptcha = async (token: string, remoteIp?: string): Promise<boolean> => {
  if (!isRecaptchaEnabled()) {
    return true
  }

  try {
    const params = new URLSearchParams()
    params.set("secret", config.recaptchaSecret as string)
    params.set("response", token)
    if (remoteIp) {
      params.set("remoteip", remoteIp)
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!response.ok) {
      console.warn("reCAPTCHA verification failed with status", response.status)
      return false
    }

    const payload = (await response.json()) as RecaptchaResponse
    if (!payload.success) {
      console.warn("reCAPTCHA rejected request", payload["error-codes"])
    }

    return payload.success === true
  } catch (error) {
    console.error("reCAPTCHA verification error", error)
    return false
  }
}

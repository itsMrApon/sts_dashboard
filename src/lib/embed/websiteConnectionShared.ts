/** Shared by server actions (the go-live gate) and the client (the connect pop-up). */
export type WebsiteConnection = { connected: boolean; origin: string | null }

export const WEBSITE_REQUIRED_ERROR = 'Connect your website first (Services → Connection), then publish.'

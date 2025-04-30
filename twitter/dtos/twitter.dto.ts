export interface TwitterState {
	savingUpdates: number;
	frontendCodeUpdates: number;
}

export interface TwitterAccessToken {
	access_token: string;
	access_secret: string;
}

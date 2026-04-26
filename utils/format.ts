export const formatCurrency = (value: string | number, minimumFractionDigits = 2, maximumFractionDigits = 2) => {
	const amount = typeof value === 'string' ? parseFloat(value) : value;

	if (amount === null || !!isNaN(amount)) return null;

	if (amount < 0.01 && amount > 0 && maximumFractionDigits) {
		return '< 0,01';
	}

	const formatter = new Intl.NumberFormat('de-DE', {
		minimumFractionDigits,
		maximumFractionDigits,
	});

	return formatter.format(amount);
};

/**
 * Sanitize untrusted strings before interpolating them into Telegram Markdown V1 messages.
 *
 * On-chain values like ERC-20 `name()` / `symbol()` are attacker-controlled. A token whose
 * name is `*x*` or contains an unbalanced `[` will either be rendered as formatting or cause
 * Telegram to reject the entire message with `Bad Request: can't parse entities` — silently
 * dropping the alert. We replace the special chars with their fullwidth Unicode counterparts
 * so the text reads naturally without breaking parsing.
 */
export const safeMarkdown = (value: string | undefined | null): string => {
	if (!value) return '';
	return value
		.replace(/\*/g, '＊')
		.replace(/_/g, '＿')
		.replace(/`/g, '｀')
		.replace(/\[/g, '［')
		.replace(/\]/g, '］')
		.replace(/\(/g, '（')
		.replace(/\)/g, '）');
};

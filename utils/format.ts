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

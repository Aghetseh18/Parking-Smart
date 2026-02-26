const calculatePrice = (durationMinutes) => {
    const ratePerHour = parseInt(process.env.RATE_PER_HOUR) || 500;

    // Price = (duration / 60) * RATE_PER_HOUR, rounded up to nearest 30 mins
    // Let's implement rounding up to nearest hour for simplicity or 30 mins as requested
    // Rounding up to nearest 30 mins:
    const roundedHours = Math.ceil(durationMinutes / 30) * 0.5;
    const price = Math.ceil(roundedHours * ratePerHour);

    return price;
};

module.exports = { calculatePrice };

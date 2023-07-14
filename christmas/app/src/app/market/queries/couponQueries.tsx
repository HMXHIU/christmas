export const fetchCoupons = async () => {
    // Fetch coupons from the API or any other data source
    const response = await fetch("/api/coupons");
    const data = await response.json();
    return data;
};

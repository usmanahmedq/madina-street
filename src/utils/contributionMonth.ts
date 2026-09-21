const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const currentMonth = () => localDate().slice(0, 7);
export function monthKey(value: string, year?: number): string {
    const text = String(value || '').trim();
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text))
        return text;
    const match = /^([a-z]+)(?:\s+(\d{4}))?$/i.exec(text);
    const index = match ? names.findIndex(n => n.toLowerCase() === match[1].toLowerCase()) : -1;
    const y = match?.[2] ? Number(match[2]) : year;
    if (index < 0 || !y || y < 1900 || y > 9999)
        throw new Error('A valid contribution month and year are required.');
    return `${y}-${String(index + 1).padStart(2, '0')}`;
}
export const monthLabel = (key: string) => `${names[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
export const monthOptions = () => names.map(name => `${name} ${currentMonth().slice(0, 4)}`);

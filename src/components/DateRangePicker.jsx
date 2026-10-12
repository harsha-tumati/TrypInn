import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// On phones the calendar opens as a centred overlay (withPortal) rather than a
// popover pinned to the field — the popover drifted when the keyboard opened
// or the modal scrolled — and inputMode="none" means tapping the field shows
// the calendar, not the keyboard.
const phoneInput = <input inputMode="none" className="input-field" />;

export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, isMobile }) {
    const phone = isMobile ? { withPortal: true, customInput: phoneInput } : {};
    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 12,
    };
    return (
        <div style={gridStyle}>
            <DatePicker
                selected={startDate}
                onChange={onStartChange}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                minDate={new Date()}
                className="input-field"
                placeholderText="Start date"
                dateFormat="MMM d, yyyy"
                {...phone}
            />
            <DatePicker
                selected={endDate}
                onChange={onEndChange}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate || new Date()}
                className="input-field"
                placeholderText="End date"
                dateFormat="MMM d, yyyy"
                {...phone}
            />
        </div>
    );
}

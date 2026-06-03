import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, isMobile }) {
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
            />
        </div>
    );
}

// An always-open range calendar: tap the first day, then the last. Two
// months side by side on wider screens, one on phones. Used by the create-trip
// steps, where the calendar is the whole step instead of a popover.
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function DateRangeCalendar({ startDate, endDate, onChange, months = 2 }) {
    return (
        <div className="ctw-calendar">
            <DatePicker
                inline
                selectsRange
                startDate={startDate}
                endDate={endDate}
                onChange={([start, end]) => onChange(start, end)}
                minDate={new Date()}
                monthsShown={months}
            />
        </div>
    );
}

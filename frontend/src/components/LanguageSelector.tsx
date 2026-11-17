import { useTranslation } from 'react-i18next';
import i18next from '@/i18n';

export default function LanguageSelector() {
    const { i18n } = useTranslation();

    function changeLanguage(e: MouseEvent) {
        i18n.changeLanguage((e.target as HTMLButtonElement).value);
        i18next.changeLanguage((e.target as HTMLButtonElement).value);
    }

    return (
        <div className="switcher">
            <button onClick={changeLanguage} className="language-btn btn" value="de">
                <img
                src="https://flagcdn.com/de.svg"
                width="30"
                alt="Deutsch" />
                Deutsch</button>
            <button onClick={changeLanguage} className="language-btn btn" value="en">
                <img
                src="https://flagcdn.com/us.svg"
                width="30"
                alt="English" />
                English</button>
        </div>
    );
}
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import ParentalAbsenceForm from './ParentalAbsenceForm.jsx'
import MobileSignPage from './MobileSignPage.jsx'
import './index.css'

function App() {
    const [route, setRoute] = useState(parseHash());

    function parseHash() {
        const hash = window.location.hash;
        const match = hash.match(/^#\/sign\/(.+)$/);
        if (match) return { page: 'sign', peerId: match[1] };
        return { page: 'main' };
    }

    useEffect(() => {
        const onHash = () => setRoute(parseHash());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    if (route.page === 'sign') {
        return <MobileSignPage targetPeerId={route.peerId} />;
    }

    return <ParentalAbsenceForm />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

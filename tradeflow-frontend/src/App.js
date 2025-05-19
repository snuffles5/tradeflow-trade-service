import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TradeForm from "./components/TradeForm.jsx";
import TradesList from "./components/TradesList.jsx";
import SummaryPage from "./components/SummaryPage.jsx";

function App() {
  return (
    <Router basename={process.env.PUBLIC_URL}>
      <Routes>
        <Route path="/" element={<TradeForm />} />
        <Route path="/trades" element={<TradesList />} />
        <Route path="/summary" element={<SummaryPage />} />
      </Routes>
    </Router>
  );
}

export default App;

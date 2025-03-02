import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TradeForm from "./components/TradeForm";
import TradesList from "./components/TradesList";
import SummaryPage from "./components/SummaryPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TradeForm />} />
        <Route path="/trades" element={<TradesList />} />
        <Route path="/summary" element={<SummaryPage />} />
      </Routes>
    </Router>
  );
}

export default App;

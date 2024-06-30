import { Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import ExplorePage from "./pages/ExplorePage";
import LikesPage from "./pages/LikesPage";

import Sidebar from './componenets/Sidebar';

function App() {
  

  return  (
    <div className='flex text-white'>
      <Sidebar />
        <div className='max-w-5xl my-5 text-white mx-auto transiiton-all duration-300 flex-1'>
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/login' element={<LoginPage />} />
            <Route path='/signup' element={<SignUpPage />} />
            <Route path='/explore' element={<ExplorePage />} />
            <Route path='/likes' element={<LikesPage />} />
          </Routes>
          
        </div>
    </div>
  );
}

export default App




import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login.jsx';
import Dashboard from './pages/dashboard';
import AdminInfo from "./pages/AdminInfo";
import AdminCrime from "./pages/AdminCrime";
import AdminSuspect from "./pages/AdminSuspect";
import VictimeSupectTable from "./pages/VictimeSuspectTables.jsx";
import AdminMaps from "./pages/AdminMaps.jsx";
import AdminAnalytics from "./pages/AdminAnalytics.jsx";
import AdminArchivedReports from "./pages/AdminArchivedReports.jsx";
import AdminArchivedInfo from "./pages/AdminArchivedInfo.jsx";
import Logout from "./pages/Logout.jsx";
import AdminForgotPassword from "./pages/AdminForgotPassword";
import AdminVerifyOtp from "./pages/AdminVerifyOtp";
import AdminResetPassword from "./pages/AdminResetPassword";
import AdminVerifications from "./pages/AdminVerifications.jsx";
import Admin2FASetup from "./pages/Admin2FASetup.jsx";


// user
import Userlogin from './pages/Userlogin.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import RegisterSuccess from "./pages/RegisterSuccess.jsx";
import UserViewReport from "./pages/UserViewReport.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import UserVictimReport from "./pages/UserVictimReport.jsx";
import UserSuspectReport from "./pages/UserSuspectReport.jsx";
import UserMaps from "./pages/UserMaps.jsx";
import UserForgotPassword from "./pages/UserForgotPassword.jsx";
import UserVerifyOtp from "./pages/UserVerifyOtp.jsx";
import UserResetPassword from "./pages/UserResetPassword";


import Landingpage from "./pages/LandingPage/landingpage.jsx";
import Home from "./pages/LandingPage/home.jsx";
import About from "./pages/LandingPage/about.jsx";
import CrimeMaps from "./pages/LandingPage/crimemaps.jsx";
import Services from "./pages/LandingPage/services.jsx";
import Contact from "./pages/LandingPage/contact.jsx";


// import PrivateRoute from './components/PrivateRoute';

import 'leaflet/dist/leaflet.css';


function App() {
  return (
    <Routes>
      <Route path="/UserLanding" element={<Landingpage />} />

      <Route path="/UserDashboard" element={<UserDashboard />} />
      <Route path="/" element={<Landingpage />} />
      {/* <Route path="/" element={<Userlogin />} /> */}
      <Route path="/Userlogin" element={<Userlogin />} />
      <Route path="/register/success" element={<RegisterSuccess />} />
      <Route path="/UserProfile" element={<UserProfile />} />
      <Route path="/UserViewReport" element={<UserViewReport />} />
      <Route path="/UserVictimReport" element={<UserVictimReport />} />
      <Route path="/UserSuspectReport" element={<UserSuspectReport />} />
      <Route path="/UserForgotPassword" element={<UserForgotPassword />} />
      <Route path="/user/verify" element={<UserVerifyOtp />} />
      <Route path="/user/reset" element={<UserResetPassword />} />
      <Route path="/UserMaps" element={<UserMaps />} />
      {/* admin */}
      <Route path="/Login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard/>} />
      <Route path="/AdminInfo" element={<AdminInfo />} />
      <Route path="/AdminCrime" element={<AdminCrime />} />
      <Route path="/AdminSuspect" element={<AdminSuspect />} />
      <Route path="/VictimeSupectTable" element={<VictimeSupectTable />} />
      <Route path="/AdminMaps" element={<AdminMaps />} />
      <Route path="/AdminAnalytics" element={<AdminAnalytics />} />
      <Route path="/AdminArchivedReports" element={<AdminArchivedReports />} />
      <Route path="/AdminArchivedInfo" element={<AdminArchivedInfo />} />
      <Route path="/AdminVerifications" element={<AdminVerifications />} />
      <Route path="/admin/2fa/setup" element={<Admin2FASetup />} />        
      <Route path="/logout" element={<Logout />} />

      <Route path="/admin/forgot" element={<AdminForgotPassword />} />
      <Route path="/admin/verify" element={<AdminVerifyOtp />} />
      <Route path="/admin/reset" element={<AdminResetPassword />} />

      {/* LandingPage */}
      <Route path="/LPHome" element={<Home />} />
      <Route path="/LPAbout" element={<About />} />
      <Route path="/LPCrime" element={<CrimeMaps />} />
      <Route path="/LPServices" element={<Services />} />
      <Route path="/LPContact" element={<Contact />} />

      
    </Routes>



  );
}

export default App;

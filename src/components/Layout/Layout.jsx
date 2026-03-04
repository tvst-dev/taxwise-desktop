import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { NewEntryModal, ExportModal, TaxCalculatorModal, ConfirmModal, SubscriptionModal } from '../Modals';
import Chatbot from '../Chatbot/Chatbot';

const Layout = () => {
  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <Outlet />
      </main>

      {/* Global Modals */}
      <NewEntryModal />
      <ExportModal />
      <TaxCalculatorModal />
      <ConfirmModal />
      <SubscriptionModal />

      {/* Global AI Chatbot - accessible from every screen */}
      <Chatbot />
    </div>
  );
};

const styles = {
  layout: {
    display: 'flex',
    height: '100%',
    backgroundColor: '#0D1117',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#0D1117',
  },
};

export default Layout;

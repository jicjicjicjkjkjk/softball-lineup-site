/* =========================
   MOBILE LINEUP CARD
   ========================= */

.mobile-lineup-card-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.45);
  padding: 14px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: auto;
}

.mobile-lineup-card {
  width: min(100%, 1100px);
  max-height: calc(100vh - 28px);
  margin: 0 auto;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mobile-lineup-card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: #e6f4f4;
}

.mobile-lineup-card-header h2 {
  margin: 0;
  font-size: 20px;
}

.mobile-lineup-card-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mobile-lineup-card-scroll {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-lineup-card-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  table-layout: fixed;
}

.mobile-lineup-card-table th,
.mobile-lineup-card-table td {
  border: 1px solid #d6dee8;
  padding: 6px;
  text-align: center;
  font-size: 13px;
}

.mobile-lineup-card-table th {
  background: #dff0ef;
  font-weight: 800;
  position: sticky;
  top: 0;
  z-index: 4;
}

.mobile-lineup-card-table th:nth-child(1),
.mobile-lineup-card-table td:nth-child(1),
.mobile-lineup-card-table th:nth-child(2),
.mobile-lineup-card-table td:nth-child(2) {
  width: 48px;
}

.mobile-lineup-card-table th:nth-child(3),
.mobile-lineup-card-table td:nth-child(3) {
  width: 170px;
  text-align: left;
  position: sticky;
  left: 0;
  z-index: 5;
  background: #fff;
}

.mobile-lineup-card-table th:nth-child(3) {
  background: #dff0ef;
  z-index: 7;
}

.mobile-lineup-player {
  font-weight: 700;
}

.mobile-lineup-out {
  background: #eff6ff;
  font-weight: 800;
}

@media (max-width: 700px) {
  .mobile-lineup-card-overlay {
    padding: 8px;
  }

  .mobile-lineup-card-header h2 {
    font-size: 18px;
  }

  .mobile-lineup-card-table th,
  .mobile-lineup-card-table td {
    padding: 7px 6px;
    font-size: 13px;
  }
}

@media print {
  body * {
    visibility: hidden;
  }

  .mobile-lineup-card-overlay,
  .mobile-lineup-card-overlay * {
    visibility: visible;
  }

  .mobile-lineup-card-overlay {
    position: absolute;
    inset: 0;
    padding: 0;
    margin: 0;
    background: #fff;
  }

  .mobile-lineup-card {
    box-shadow: none;
    border-radius: 0;
    max-height: none;
  }

  .mobile-lineup-card-actions {
    display: none !important;
  }

  .mobile-lineup-card-scroll {
    overflow: visible !important;
  }

  .mobile-lineup-card-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
  }
}

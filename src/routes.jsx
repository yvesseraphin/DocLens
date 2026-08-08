import { LoginPage } from './pages/auth/LoginPage.jsx';
import { SignupPage } from './pages/auth/SignupPage.jsx';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.jsx';
import { EmailVerificationPage } from './pages/auth/EmailVerificationPage.jsx';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage.jsx';
import { DashboardHomePage } from './pages/dashboard/DashboardHomePage.jsx';
import { CasesPage } from './pages/cases/CasesPage.jsx';
import { AddCaseStepOnePage } from './pages/cases/AddCaseStepOnePage.jsx';
import { AddCaseStepTwoPage } from './pages/cases/AddCaseStepTwoPage.jsx';
import { AddCaseAnalysisPage } from './pages/cases/AddCaseAnalysisPage.jsx';
import { ReportPage } from './pages/reports/ReportPage.jsx';
import { ReportSummaryPage } from './pages/reports/ReportSummaryPage.jsx';
import { ReportEvidencePage } from './pages/reports/ReportEvidencePage.jsx';
import { ReportFindingsPage } from './pages/reports/ReportFindingsPage.jsx';
import { ReportExportPage } from './pages/reports/ReportExportPage.jsx';

export const routes = {
  '/login': LoginPage,
  '/signup': SignupPage,
  '/forgot-password': ForgotPasswordPage,
  '/email-verification': EmailVerificationPage,
  '/change-password': ChangePasswordPage,
  '/dashboard': DashboardHomePage,
  '/cases': CasesPage,
  '/cases/add/step-1': AddCaseStepOnePage,
  '/cases/add/step-2': AddCaseStepTwoPage,
  '/cases/analysis': AddCaseAnalysisPage,
  '/cases/report': ReportPage,
  '/cases/reports': ReportPage,
  '/cases/report/summary': ReportSummaryPage,
  '/cases/reports/summary': ReportSummaryPage,
  '/cases/report/evidence': ReportEvidencePage,
  '/cases/reports/evidence': ReportEvidencePage,
  '/cases/report/findings': ReportFindingsPage,
  '/cases/reports/findings': ReportFindingsPage,
  '/cases/report/export': ReportExportPage,
  '/cases/reports/export': ReportExportPage,
  '/reports': ReportPage,
  '/reports/evidence': ReportEvidencePage,
};

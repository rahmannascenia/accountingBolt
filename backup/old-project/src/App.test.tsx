import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';

describe('App', () => {
  it('renders the App component', async () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/FinanSys/i)).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import React from 'react';
import { Toaster as Sonner } from "sonner";
import { Provider as TooltipProvider } from "@radix-ui/react-tooltip";

import { PasswordProvider } from "@/contexts/PasswordContext";
import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import HomePage from "@/pages/HomePage";
import Statistics from "@/pages/Statistics";
import HistoryPage from "@/pages/HistoryPage";
import LoadMatch from "@/pages/LoadMatch";
import PlayersPage from "@/pages/PlayersPage";
import PlayerProfile from "@/pages/PlayerProfile";
import VotePage from "@/pages/VotePage";
import TeamBuilder from "@/pages/TeamBuilder";
import GamesPage from "@/pages/GamesPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PasswordProvider>
        <ErrorBoundary>
          <Sonner position="top-center" theme="dark" richColors />
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/estadisticas" element={<Statistics />} />
                <Route path="/historial" element={<HistoryPage />} />
                <Route path="/cargar" element={<LoadMatch />} />
                <Route path="/jugadores" element={<PlayersPage />} />
                <Route path="/jugador/:id" element={<PlayerProfile />} />
                <Route path="/votar/:matchId" element={<VotePage />} />
                <Route path="/armar-equipos" element={<TeamBuilder />} />
                <Route path="/juegos" element={<GamesPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </ErrorBoundary>
      </PasswordProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import React, { createContext, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildGrievancesUrl } from '../utils/politicianNavigation';

const PoliticianNavigationContext = createContext(null);

/**
 * Provides navigateToPoliticianGrievances(entity) to any child component.
 * entity shape: { id, name, shortName, role, constituency, image, ... }
 * Extendable to MPs or other entity types via entity.entityType.
 */
export const PoliticianNavigationProvider = ({ children }) => {
  const navigate = useNavigate();

  const navigateToPoliticianGrievances = useCallback((entity) => {
    if (!entity) return;
    navigate(buildGrievancesUrl(entity));
  }, [navigate]);

  return (
    <PoliticianNavigationContext.Provider value={{ navigateToPoliticianGrievances }}>
      {children}
    </PoliticianNavigationContext.Provider>
  );
};

export const usePoliticianNavigation = () => {
  const ctx = useContext(PoliticianNavigationContext);
  if (!ctx) return { navigateToPoliticianGrievances: () => {} };
  return ctx;
};

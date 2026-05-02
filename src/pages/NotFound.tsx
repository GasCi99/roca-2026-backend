import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-6xl font-black text-gray-200 mb-4">404</h1>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Página no encontrada</h2>
      <p className="text-gray-500 mb-6">La página que buscas no existe o ha sido movida.</p>
      <Link to="/" className="bg-green-600 text-white px-6 py-2 rounded-md font-medium hover:bg-green-700">
        Volver al Inicio
      </Link>
    </div>
  );
};

export default NotFound;

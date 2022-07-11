import React from "react";
import "bootstrap/dist/css/bootstrap.css";

const Footer = () => {
  return (
    <div className="border-top p-3 mt-4 text-center bg-dark text-muted">
      <b>Created by Moshe Asaraf &copy; {new Date().getFullYear()}</b>
    </div>
  );
};

export default Footer;

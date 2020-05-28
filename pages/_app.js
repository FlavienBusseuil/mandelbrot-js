import React from "react";
import "antd/dist/antd.dark.css";
import "./styles.scss";

function MyApp({ Component, pageProps }) {
	return <Component {...pageProps} />;
}

export default MyApp;

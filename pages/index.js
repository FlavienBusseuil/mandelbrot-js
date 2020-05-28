import { Layout } from "antd";
import dynamic from "next/dynamic";
import React from "react";

const Sketch = dynamic(import("./Sketch"), { ssr: false });

const App = () => (
	<Layout style={{ height: "100vh" }}>
		<Sketch />
	</Layout>
);

export default App;

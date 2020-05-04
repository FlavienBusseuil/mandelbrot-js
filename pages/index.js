import React from "react";
import dynamic from "next/dynamic";

const Sketch = dynamic(import("./Sketch"), { ssr: false });

const App = () => <Sketch />;

export default App;

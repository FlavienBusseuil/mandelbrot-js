import React, { useState } from "react";
import { Modal, Button, Typography } from "antd";
import { QuestionCircleFilled, WarningOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

const Help = ({ className }) => {
	const [isModalVisible, setIsModalVisible] = useState(false);
	return (
		<>
			<Button
				className={className}
				size="large"
				shape="circle"
				onClick={() => setIsModalVisible(true)}
				icon={<QuestionCircleFilled />}
			></Button>
			<Modal
				visible={isModalVisible}
				footer={null}
				width={750}
				style={{ paddingBottom: 0 }}
				onCancel={() => setIsModalVisible(false)}
				centered
			>
				<Typography>
					<Title level={1}>Welcome to Mandelbrot JS</Title>
					<Title level={2}>What is it?</Title>
					<Paragraph>
						Mandelbrot JS is a{" "}
						<a href="https://en.wikipedia.org/wiki/Mandelbrot_set">
							Mandelbrot
						</a>{" "}
						fractal explorer. It use progressive rendering for a
						responsive and interactive experience. This project is
						not as accomplished as I would like but advanced enough
						so I am comfortable to share it officially.
					</Paragraph>
					<Title level={2}>How to use it?</Title>
					<Paragraph>
						<ul>
							<li>
								Drag to move around. Things get interesting to
								the boundary of the black region
							</li>
							<li>
								Scroll to zoom in/out and reveal whats behind
								those tiny details
							</li>
							<li>Change the number of iterations as you zoom</li>
							<li>
								Get a better final result by changing the cell
								size in the render section
							</li>
							<li>
								<WarningOutlined /> Computation can take some
								times. Reducing resolution or cell size in the
								render section helps
							</li>
						</ul>
					</Paragraph>
					<Title level={2}>Who am I?</Title>
					<Paragraph>
						My name is Flavien Busseuil and I am a developer mixing
						experiences in web development, 3D and IA. Source code
						is available here
						<a
							href="https://github.com/FlavienBusseuil/mandelbrot"
							target="_blank"
							rel="noreferrer"
						>
							https://github.com/FlavienBusseuil/mandelbrot
						</a>{" "}
						and you can contact me for any questions about this
						project at
						&#102;&#108;&#097;&#118;&#105;&#101;&#110;&#046;&#098;&#117;&#115;&#115;&#101;&#117;&#105;&#108;&#064;&#103;&#109;&#097;&#105;&#108;&#046;&#099;&#111;&#109;
					</Paragraph>
				</Typography>
			</Modal>
		</>
	);
};

export default Help;

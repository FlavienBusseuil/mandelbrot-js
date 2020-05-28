import React, { useEffect } from "react";
import {
	Row,
	Col,
	Collapse,
	Form,
	Input,
	InputNumber,
	Button,
	Checkbox,
} from "antd";
import styles from "./ControlPanel.module.scss";

const { Panel } = Collapse;
const { Item, useForm } = Form;

const ControlPanel = ({
	realCellSize,
	isComputing,
	onCancel,
	onChange,
	depth,
	targetCellSize,
	isDebugging,
	nbIteration,
	threshold,
	zone: { xmin, xmax, ymin, ymax },
	zoom,
}) => {
	const [form] = useForm();
	const handleSubmit = ({ xmin, xmax, ymin, ymax, ...params }) => {
		onChange({
			zone: { xmin, xmax, ymin, ymax },
			...params,
		});
	};

	useEffect(() => {
		form.setFieldsValue({
			depth,
			isComputing,
			isDebugging,
			nbIteration,
			targetCellSize,
			threshold,
			xmax,
			xmin,
			ymax,
			ymin,
			zoom,
		});
	});

	return (
		<Form
			className={styles.form}
			form={form}
			size="small"
			layout="vertical"
			onFinish={handleSubmit}
			initialValues={{
				depth,
				isComputing,
				isDebugging,
				nbIteration,
				targetCellSize,
				threshold,
				xmax,
				xmin,
				ymax,
				ymin,
				zoom,
			}}
		>
			<Collapse
				className={styles.collapse}
				defaultActiveKey={["1", "2", "3"]}
			>
				<Panel forceRender header="Mandelbrot" key="1">
					<Row>
						<Col span={12}>
							<Item label="Iteration" name="nbIteration">
								<InputNumber min={1} />
							</Item>
						</Col>
						<Col span={12}>
							<Item label="Threshold" name="threshold">
								<InputNumber min={1} />
							</Item>
						</Col>
					</Row>
				</Panel>
				<Panel forceRender header="Positions" key="2">
					<Item label="Zone">
						<Row>
							<Col span={12}>
								<Item label="X min" name="xmin">
									<InputNumber />
								</Item>
							</Col>
							<Col span={12}>
								<Item label="Y min" name="ymin">
									<InputNumber />
								</Item>
							</Col>
						</Row>
						<Row>
							<Col span={12}>
								<Item label="X max" name="xmax">
									<InputNumber />
								</Item>
							</Col>
							<Col span={12}>
								<Item label="Y max" name="ymax">
									<InputNumber />
								</Item>
							</Col>
						</Row>
					</Item>
					<Item label="Zoom" name="zoom">
						<InputNumber />
					</Item>
				</Panel>
				<Panel forceRender header="Draw" key="3">
					<Item label="Depth" name="depth">
						<InputNumber min={1} max={10} />
					</Item>
					<Item
						label="Cell Size"
						name="targetCellSize"
						help={`Approx. value in px`}
					>
						<InputNumber min={0.25} />
					</Item>
				</Panel>
				<Panel forceRender header="Debug" key="4">
					<Item label="Real Cell Size">
						<Row gutter={16}>
							<Col span={12}>
								<Item label="Width">
									<Input
										value={realCellSize.cellW}
										disabled
									/>
								</Item>
							</Col>
							<Col span={12}>
								<Item label="Height">
									<Input
										value={realCellSize.cellH}
										disabled
									/>
								</Item>
							</Col>
						</Row>
					</Item>
					<Item name="isDebugging" valuePropName="checked">
						<Checkbox>Draw Cells / Zones</Checkbox>
					</Item>
				</Panel>
			</Collapse>
			<div>
				{isComputing ? (
					<Button onClick={onCancel} block size="large">
						Stop
					</Button>
				) : (
					<Button type="primary" htmlType="submit" block size="large">
						Compute
					</Button>
				)}
			</div>
		</Form>
	);
};

export default ControlPanel;

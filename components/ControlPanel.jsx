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
	Select,
} from "antd";
import styles from "./ControlPanel.module.scss";

const { Panel } = Collapse;
const { Item, useForm } = Form;
const { Option } = Select;

const ControlPanel = ({
	realCellSize,
	isComputing,
	onCancel,
	onChange,
	depth,
	targetCellSize,
	isDebugging,
	nbIteration,
	resolution,
	threshold,
	zone: { xmin, xmax, ymin, ymax },
	zoom,
}) => {
	const [form] = useForm();
	const handleSubmit = ({ stop, xmin, xmax, ymin, ymax, ...params }) => {
		if (stop) {
			return onCancel({
				zone: { xmin, xmax, ymin, ymax },
				...params,
			});
		}

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
			resolution,
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
				resolution,
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
				<Panel forceRender header="Location" key="2">
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
				<Panel forceRender header="Render" key="3">
					<Item label="Resolution" name="resolution">
						<Select>
							<Option value="r310x240">310x240</Option>
							<Option value="r720x480">720x480</Option>
							<Option value="r1280x720">1280x720</Option>
							<Option value="fullview">Full View</Option>
						</Select>
					</Item>
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
			{isComputing ? (
				<Item name="stop" initialValue={true}>
					<Button htmlType="submit" block size="large">
						Stop
					</Button>
				</Item>
			) : (
				<Item name="compute" initialValue={true}>
					<Button type="primary" htmlType="submit" block size="large">
						Compute
					</Button>
				</Item>
			)}
		</Form>
	);
};

export default ControlPanel;

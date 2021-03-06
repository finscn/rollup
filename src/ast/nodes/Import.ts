import MagicString from 'magic-string';
import { RenderOptions } from '../../utils/renderHelpers';
import CallExpression from './CallExpression';
import * as NodeType from './NodeType';
import { NodeBase } from './shared/Node';

interface DynamicImportMechanism {
	interopLeft?: string;
	interopRight?: string;
	left: string;
	right: string;
}

const getDynamicImportMechanism = (options: RenderOptions): DynamicImportMechanism => {
	switch (options.format) {
		case 'cjs': {
			const _ = options.compact ? '' : ' ';
			return {
				interopLeft: `Promise.resolve({${_}default:${_}require(`,
				interopRight: `)${_}})`,
				left: 'Promise.resolve(require(',
				right: '))'
			};
		}
		case 'amd': {
			const _ = options.compact ? '' : ' ';
			const resolve = options.compact ? 'c' : 'resolve';
			const reject = options.compact ? 'e' : 'reject';
			return {
				interopLeft: `new Promise(function${_}(${resolve},${_}${reject})${_}{${_}require([`,
				interopRight: `],${_}function${_}(m)${_}{${_}${resolve}({${_}default:${_}m${_}})${_}},${_}${reject})${_}})`,
				left: `new Promise(function${_}(${resolve},${_}${reject})${_}{${_}require([`,
				right: `],${_}${resolve},${_}${reject})${_}})`
			};
		}
		case 'system':
			return {
				left: 'module.import(',
				right: ')'
			};
		case 'es':
			return {
				left: `${options.dynamicImportFunction || 'import'}(`,
				right: ')'
			};
	}
};

export default class Import extends NodeBase {
	parent: CallExpression;
	type: NodeType.tImport;

	private resolutionInterop: boolean;
	private resolutionNamespace: string;

	include() {
		this.included = true;
		this.context.includeDynamicImport(this);
	}

	initialise() {
		this.included = false;
		this.resolutionNamespace = undefined;
		this.resolutionInterop = false;
		this.context.addDynamicImport(this);
	}

	render(code: MagicString, options: RenderOptions) {
		if (this.resolutionNamespace) {
			const _ = options.compact ? '' : ' ';
			const s = options.compact ? '' : ';';
			code.overwrite(
				this.parent.start,
				this.parent.end,
				`Promise.resolve().then(function${_}()${_}{${_}return ${this.resolutionNamespace}${s}${_}})`
			);
			return;
		}

		const importMechanism = getDynamicImportMechanism(options);
		if (importMechanism) {
			const leftMechanism =
				(this.resolutionInterop && importMechanism.interopLeft) || importMechanism.left;
			code.overwrite(this.parent.start, this.parent.arguments[0].start, leftMechanism);

			const rightMechanism =
				(this.resolutionInterop && importMechanism.interopRight) || importMechanism.right;
			code.overwrite(this.parent.arguments[0].end, this.parent.end, rightMechanism);
		}
	}

	renderFinalResolution(code: MagicString, resolution: string) {
		if (this.included) {
			code.overwrite(this.parent.arguments[0].start, this.parent.arguments[0].end, resolution);
		}
	}

	setResolution(interop: boolean, namespace: string = undefined): void {
		this.resolutionInterop = interop;
		this.resolutionNamespace = namespace;
	}
}

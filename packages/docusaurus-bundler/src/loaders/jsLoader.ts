/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {getBabelOptions} from '@docusaurus/babel';
import {importSwcJsLoaderFactory} from '../importFaster';
import {getCurrentBundler} from '../currentBundler';
import type {ConfigureWebpackUtils, DocusaurusConfig} from '@docusaurus/types';

const BabelJsLoaderFactory: ConfigureWebpackUtils['getJSLoader'] = ({
  isServer,
  babelOptions,
}) => {
  return {
    loader: require.resolve('babel-loader'),
    options: getBabelOptions({isServer, babelOptions}),
  };
};

const RspackJsLoaderFactory: ConfigureWebpackUtils['getJSLoader'] = () => {
  return {
    loader: 'builtin:swc-loader',
    options: {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    },
  };
};

// Confusing: function that creates a function that creates actual js loaders
// This is done on purpose because the js loader factory is a public API
// It is injected in configureWebpack plugin lifecycle for plugin authors
export async function createJsLoaderFactory({
  siteConfig,
}: {
  siteConfig: {
    webpack?: DocusaurusConfig['webpack'];
    future: {
      experimental_faster: DocusaurusConfig['future']['experimental_faster'];
    };
  };
}): Promise<ConfigureWebpackUtils['getJSLoader']> {
  const currentBundler = await getCurrentBundler({siteConfig});
  const isSWCLoader = siteConfig.future.experimental_faster.swcJsLoader;

  if (currentBundler.name === 'rspack') {
    if (!isSWCLoader) {
      throw new Error(
        'When using Rspack bundler, it is required to enable swcJsLoader too',
      );
    }
    return RspackJsLoaderFactory;
  }
  const jsLoader = siteConfig.webpack?.jsLoader ?? 'babel';
  if (
    jsLoader instanceof Function &&
    siteConfig.future?.experimental_faster.swcJsLoader
  ) {
    throw new Error(
      "You can't use a custom webpack.jsLoader and experimental_faster.swcJsLoader at the same time",
    );
  }
  if (jsLoader instanceof Function) {
    return ({isServer}) => jsLoader(isServer);
  }
  if (siteConfig.future?.experimental_faster.swcJsLoader) {
    return importSwcJsLoaderFactory();
  }
  if (jsLoader === 'babel') {
    return BabelJsLoaderFactory;
  }
  throw new Error(`Docusaurus bug: unexpected jsLoader value${jsLoader}`);
}
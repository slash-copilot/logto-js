# Logto Node.js SDK

[![Version](https://img.shields.io/npm/v/@slash-copilot/node)](https://www.npmjs.com/package/@slash-copilot/node)
[![Build Status](https://github.com/logto-io/js/actions/workflows/main.yml/badge.svg)](https://github.com/logto-io/js/actions/workflows/main.yml)
[![Codecov](https://img.shields.io/codecov/c/github/logto-io/js)](https://app.codecov.io/gh/logto-io/js?branch=master)

The Logto Node.js SDK written in TypeScript. Check out our [docs](https://docs.logto.io/sdk/JavaScript/node/) for more information.

## Installation

### Using npm

```bash
npm install @slash-copilot/node
```

### Using yarn

```bash
yarn add @slash-copilot/node
```

### Using pnpm

```bash
pnpm add @slash-copilot/node
```

## What is this and how does it work?

As the name suggests, Logto Node.js SDK is the foundation of all Logto SDKs that run in Node.js (Express, Next.js, etc.). `@slash-copilot/node` extends `@slash-copilot/client` and provides a Node.js specific implementation of the client adapters:

- Implements `requester` by using package `node-fetch`.
- Implements `generateCodeChallenge`, `generateCodeVerifier`, `generateState` methods by using `crypto`.

Usually you are not expected to use it directly in your application, but instead choosing a framework specific SDK that built on top of it. We have already released a set of official SDKs to accelerate your integration. [Check this out](https://docs.logto.io/docs/recipes/integrate-logto/) and get started!

If Logto does not support your traditional web framework and you want to create your own SDK from scratch, we recommend checking out the SDK specification first. You can also refer to our [Express SDK](https://github.com/logto-io/js/tree/master/packages/express) and [Next.js SDK](https://github.com/logto-io/js/tree/master/packages/next) to learn more about the implementation details.

## Resources

[![Website](https://img.shields.io/badge/website-logto.io-8262F8.svg)](https://logto.io/)
[![Docs](https://img.shields.io/badge/docs-logto.io-green.svg)](https://docs.logto.io/sdk/JavaScript/node/)
[![Discord](https://img.shields.io/discord/965845662535147551?logo=discord&logoColor=ffffff&color=7389D8&cacheSeconds=600)](https://discord.gg/UEPaF3j5e6)

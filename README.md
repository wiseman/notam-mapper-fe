# NOTAM Mapper frontend

This is a sveltekit frontend for the NOTAM Mapper project. See
https://github.com/wiseman/notam-mapper-be for the backend code.

## Installation

```
pnpm install
```

## Running


First set the `API_SERVER` environment variable to the URL of the backend, e.g.
`API_SERVER=http://localhost:8000`.

Then set the `ORIGIN` environment variable to the URL of the frontend, e.g.
`ORIGIN=http://localhost:5173`.

To run in dev mode:
```
pnpm dev
```

To build and run in production mode:
```
pnpm build
node build
```



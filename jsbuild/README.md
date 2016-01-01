Publish
-------

To publish a build to npm run:

```
kudu/src>npm publish ./
```

Publish locally
---------------
To publish a build locally as a tgz, run:

```
kudu/src>npm pack
```

Then you can test it locally with

```
someFolder>npm install path/to/kudu.version.tgz
```
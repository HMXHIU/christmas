## Instructions

Dump the 3 folders `images`, `tilemaps`, and `tilesets` into the `s3` or `minio` bucket called `tiled`. Make sure the folder is `private`.

```
tiled/
    /public
        /images
        /tilemaps
        /tilesets
```

When reading the `tileset` from the `tilemap` and the `images` from the `tileset`, replace the relative path with the s3 root in code.

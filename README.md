# smartui-cli

### Configure your Project Token

Setup your project token show in the **SmartUI** app after, creating your project.

 <b>For Linux/macOS:</b>
 
  ```
 export PROJECT_TOKEN="123456#1234abcd-****-****-****-************"
  ```

   <b>For Windows:</b>

  ```
  set PROJECT_TOKEN="123456#1234abcd-****-****-****-************"
  ```



### To capture screenshot 
```
npm run capture 
```

### To capture screenshot with default configs
```
npm run capture-with-deafult-config
```

### To Create Web config for multiple browser and viewports
```
npm run config:create-web
or 
npm run config:create-web smartui-web.json
```

### To Create Static config for multiple URLs
```
npm run config:web-static
or 
npm run config:web-static urls.json
```

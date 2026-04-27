pipeline {
    agent any

    environment {
        EC2_HOST = credentials('EC2_HOST')
        EC2_USER = 'ubuntu'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing dependencies...'
                sh 'cd backend && npm ci'
            }
        }

        stage('Test') {
            steps {
                echo 'Running tests...'
                sh '''
                    cd backend
                    npm test -- --watchAll=false
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                echo 'Building Docker images...'
                sh 'docker-compose build --no-cache'
            }
        }

        stage('Deploy to EC2') {
            when {
                branch 'main'
            }
            steps {
                echo 'Deploying to EC2...'
                sshagent(['EC2_SSH_KEY']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST "
                            cd /home/ubuntu/app &&
                            git pull origin main &&
                            docker-compose down &&
                            docker-compose build --no-cache &&
                            docker-compose up -d
                        "
                    '''
                }
            }
        }

        stage('Health Check') {
            when {
                branch 'main'
            }
            steps {
                echo 'Running health checks...'
                sshagent(['EC2_SSH_KEY']) {
                    sh '''
                        sleep 15
                        ssh -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST "
                            STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/health)
                            echo Backend status: \$STATUS
                            if [ \"\$STATUS\" != \"200\" ]; then
                                echo Health check failed
                                exit 1
                            fi
                            echo All checks passed
                        "
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
        always {
            sh 'docker system prune -f'
        }
    }
}